"""Concurrent pytest runs in one checkout must not share (and wipe) a basetemp directory."""

import os


def test_basetemp_is_private_to_this_process(tmp_path_factory):
    assert tmp_path_factory.getbasetemp().name == f"run-{os.getpid()}"
