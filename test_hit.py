import sys, json, requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# directly try to insert "?? High Compliance" to score_reports maybe?
# or just look at the uvicorn output
