"""Configuration settings for SmartFlow Engine."""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration."""
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    ENVIRONMENT = 'development'


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    ENVIRONMENT = 'production'


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    ENVIRONMENT = 'testing'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
