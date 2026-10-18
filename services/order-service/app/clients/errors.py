class UpstreamUnavailable(Exception):
    """Network error, timeout or unexpected answer from another service."""


class ProductNotFound(Exception):
    pass


class InsufficientStock(Exception):
    pass
