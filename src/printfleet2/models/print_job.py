from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import text

from printfleet2.db.base import Base


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_date: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    gcode_filename: Mapped[str] = mapped_column(String, nullable=False)
    printer_name: Mapped[str] = mapped_column(String, nullable=False)
    username: Mapped[str] = mapped_column(String, nullable=False)
    print_via: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("'unknown'"),
    )
