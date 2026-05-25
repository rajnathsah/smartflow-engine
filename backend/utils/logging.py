import contextvars
import logging
import structlog

# Define multi-tenant context variable.
# This variable is isolated to the current execution context (coroutine / thread).
tenant_uuid_context: contextvars.ContextVar[str] = contextvars.ContextVar("tenant_uuid")


def inject_tenant_context(logger, log_method, event_dict):
    """
    Custom structlog processor that inspects the current coroutine/thread contextvars
    and automatically injects the active tenant_uuid into the JSON payload.
    """
    try:
        tenant_uuid = tenant_uuid_context.get()
        if tenant_uuid:
            event_dict["tenant_uuid"] = tenant_uuid
    except LookupError:
        # Context variable is unset for this thread
        pass
    except Exception:
        pass
    return event_dict


def configure_logging():
    """
    Configures structlog to output ISO-timestamped JSON logs.
    Decoupled processors automatically track call-stacks, log levels,
    active tenant isolation flags, and formats exceptions.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            inject_tenant_context,  # Dynamic tenant context variable mapping
            structlog.processors.JSONRenderer()  # Format as single-line JSON entries
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )


# Instantiate the global structlog logger for use across the application
logger = structlog.get_logger("synq")
