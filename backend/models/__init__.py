from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

from .user import User
from .tenant import Tenant
from .pipeline import Source, Destination, Connection, Log
from .document import DocumentChunk
