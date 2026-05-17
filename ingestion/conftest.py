"""Make the `crypt_ingest` package importable when running the tests without
an editable install."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
