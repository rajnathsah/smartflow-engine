import contextvars
import logging
import structlog

tenant_uuid_context: contextvars.ContextVar[str] = contextvars.ContextVar("tenant_uuid")

def inject_tenant_context(logger, log_method, event_dict) -> dict:
    """Structlog processor that injects the active tenant_uuid context variable.

    Args:
        logger: Logger instance.
        log_method: Logger method name.
        event_dict: Logging event dict.

    Returns:
        dict: The updated event dict containing active tenant UUID.
    """
    try:
        tenant_uuid = tenant_uuid_context.get()
        if tenant_uuid:
            event_dict["tenant_uuid"] = tenant_uuid
    except LookupError:
        pass
    except Exception:
        pass
    return event_dict

def configure_logging() -> None:
    """Configures structlog to output JSON formatted logs with standard processors."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            inject_tenant_context,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )

logger = structlog.get_logger("synq")
