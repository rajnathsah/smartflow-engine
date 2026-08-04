import sys
import asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import os
import urllib.parse
from sqlalchemy import create_engine, text, inspect
from backend.config import settings
from backend.utils.logging import logger
from backend.workers.tasks import load_records_chunked

async def run_self_healing_tests():
    print("\n=== STARTING SELF-HEALING ARCHITECTURE TESTS ===")
    
    # 1. SETUP: Prepare database uri info
    host = settings.POSTGRES_SERVER
    if host.lower() in ("localhost", "127.0.0.1", "::1") and settings.POSTGRES_DOCKER_HOST:
        host = settings.POSTGRES_DOCKER_HOST

    escaped_user = urllib.parse.quote_plus(settings.POSTGRES_USER)
    escaped_password = urllib.parse.quote_plus(settings.POSTGRES_PASSWORD)
    
    test_db_name = "self_healing_test_db"
    
    # Connect to default postgres to drop test_db if exists
    default_db_uri = f"postgresql+psycopg://{escaped_user}:{escaped_password}@{host}:{settings.POSTGRES_PORT}/postgres"
    temp_engine = create_engine(default_db_uri, isolation_level="AUTOCOMMIT")
    with temp_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{test_db_name}"'))
        print(f"[Test Setup] Ensured '{test_db_name}' does not exist.")
    temp_engine.dispose()

    # 2. TEST DATABASE AUTO-CREATION ON STARTUP
    print("\n--- 1. Testing Database Auto-Creation ---")
    # Temporarily override settings database name
    original_db = settings.POSTGRES_DB
    settings.POSTGRES_DB = test_db_name
    
    from backend.database.database import ensure_database_exists
    
    # Trigger ensure_database_exists - it should catch that test_db_name does not exist and create it!
    ensure_database_exists()
    
    # Verify the database exists in postgres catalogs
    temp_engine = create_engine(default_db_uri)
    with temp_engine.connect() as conn:
        res = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :dbname"), {"dbname": test_db_name})
        exists = res.scalar() is not None
        assert exists, "Test database should have been automatically created!"
        print(f"[Test Pass] Database '{test_db_name}' was successfully auto-created on startup.")
    temp_engine.dispose()
    
    # Restore original database settings
    settings.POSTGRES_DB = original_db

    # 2.5. TEST CONNECTION TESTER FALLBACK AUTO-CREATION
    print("\n--- 1.5. Testing Connection Tester Fallback Auto-Creation ---")
    test_conn_db_name = "test_conn_tester_db"
    
    # Ensure this doesn't exist
    temp_engine = create_engine(default_db_uri, isolation_level="AUTOCOMMIT")
    with temp_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{test_conn_db_name}"'))
    temp_engine.dispose()
    
    from backend.utils.connection_tester import test_db_connection
    config_payload = {
        "targetDb": "postgresql",
        "host": host,
        "port": settings.POSTGRES_PORT,
        "database": test_conn_db_name,
        "username": settings.POSTGRES_USER,
        "password": settings.POSTGRES_PASSWORD
    }
    
    res_test = await test_db_connection(config_payload)
    assert res_test.get("success") is True, f"Connection test failed: {res_test.get('message')}"
    
    # Verify the database exists
    temp_engine = create_engine(default_db_uri)
    with temp_engine.connect() as conn:
        res_db = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :dbname"), {"dbname": test_conn_db_name})
        exists = res_db.scalar() is not None
        assert exists, f"Database '{test_conn_db_name}' should have been created by connection tester!"
        print(f"[Test Pass] Connection tester successfully created database '{test_conn_db_name}' and connected to it silently.")
    temp_engine.dispose()
    
    # Drop database
    temp_engine = create_engine(default_db_uri, isolation_level="AUTOCOMMIT")
    with temp_engine.connect() as conn:
        conn.execute(text(
            f"SELECT pg_terminate_backend(pg_stat_activity.pid) "
            f"FROM pg_stat_activity "
            f"WHERE pg_stat_activity.datname = '{test_conn_db_name}' "
            f"AND pid <> pg_backend_pid()"
        ))
        conn.execute(text(f'DROP DATABASE IF EXISTS "{test_conn_db_name}"'))
    temp_engine.dispose()

    # 3. TEST DYNAMIC SCHEMA TARGET TABLE CREATION & ALTERATION
    print("\n--- 2. Testing Dynamic Schema Table Creation & Auto-Heal Alteration ---")
    # Create an engine to the test database
    test_db_uri = f"postgresql+psycopg://{escaped_user}:{escaped_password}@{host}:{settings.POSTGRES_PORT}/{test_db_name}"
    from sqlalchemy.ext.asyncio import create_async_engine
    
    # Convert uri to async format for the test
    async_test_db_uri = test_db_uri.replace("postgresql+psycopg", "postgresql+psycopg")
    async_engine = create_async_engine(async_test_db_uri)
    
    table_name = "test_etl_dynamic_table"
    
    # Chunk 1 payload (initial schema definition)
    chunk_1 = [
        {"user_id": 101, "full_name": "Alice Cooper"},
        {"user_id": 102, "full_name": "Bob Vance"}
    ]
    
    # We call load_records_chunked with an empty mapping to trigger auto-inference and creation
    print("[Test ETL] Loading first chunk (expecting CREATE TABLE)...")
    await load_records_chunked(
        engine=async_engine,
        table_name=table_name,
        schema_mapping=None,  # triggers inference
        records_generator=[chunk_1]
    )
    
    # Verify table structure after first load
    async with async_engine.connect() as conn:
        def inspect_columns(connection):
            inspector = inspect(connection)
            return {col["name"]: str(col["type"]) for col in inspector.get_columns(table_name)}
            
        columns = await conn.run_sync(inspect_columns)
        print(f"[Test Verify] Initial columns in table: {columns}")
        assert "user_id" in columns, "Column 'user_id' should exist."
        assert "full_name" in columns, "Column 'full_name' should exist."
        
    # Chunk 2 payload (contains new fields: status, age, score)
    chunk_2 = [
        {"user_id": 103, "full_name": "Charlie Brown", "status": "active", "age": 28, "score": 95.5}
    ]
    
    # Load second chunk - it should detect new fields and execute ALTER TABLE ADD COLUMN statements
    print("\n[Test ETL] Loading second chunk with new fields (expecting ALTER TABLE auto-heal)...")
    await load_records_chunked(
        engine=async_engine,
        table_name=table_name,
        schema_mapping=None,  # triggers inference & dynamic schema expansion
        records_generator=[chunk_2]
    )
    
    # Verify table structure after dynamic schema alteration
    async with async_engine.connect() as conn:
        columns = await conn.run_sync(inspect_columns)
        print(f"[Test Verify] Auto-healed columns in table: {columns}")
        assert "status" in columns, "Column 'status' should have been dynamically added!"
        assert "age" in columns, "Column 'age' should have been dynamically added!"
        assert "score" in columns, "Column 'score' should have been dynamically added!"
        print("[Test Pass] Missing fields detected and table successfully auto-healed via ALTER TABLE.")

    # 4. CLEANUP: Drop test database
    await async_engine.dispose()
    temp_engine = create_engine(default_db_uri, isolation_level="AUTOCOMMIT")
    with temp_engine.connect() as conn:
        conn.execute(text(
            f"SELECT pg_terminate_backend(pg_stat_activity.pid) "
            f"FROM pg_stat_activity "
            f"WHERE pg_stat_activity.datname = '{test_db_name}' "
            f"AND pid <> pg_backend_pid()"
        ))
        conn.execute(text(f'DROP DATABASE IF EXISTS "{test_db_name}"'))
        print(f"\n[Test Cleanup] Dropped test database '{test_db_name}'.")
    temp_engine.dispose()

    print("\n=== ALL SELF-HEALING ARCHITECTURE TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_self_healing_tests())
