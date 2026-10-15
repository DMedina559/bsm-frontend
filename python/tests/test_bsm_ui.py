from bsm_frontend import get_static_dir


def test_get_static_dir():
    static_dir = get_static_dir()
    assert static_dir is not None
    assert str(static_dir).endswith("static")
    # Note: We can't verify existence of the directory here because it might not be built yet
    # during simple test runs, but we can verify the path structure.
