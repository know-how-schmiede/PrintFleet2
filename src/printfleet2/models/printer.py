from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from printfleet2.db.base import Base


class Printer(Base):
    __tablename__ = "printers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    backend: Mapped[str] = mapped_column(String, nullable=False)
    host: Mapped[str] = mapped_column(String, nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    https: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0")
    scanning: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    token: Mapped[str | None] = mapped_column(String, nullable=True)
    api_key: Mapped[str | None] = mapped_column(String, nullable=True)
    error_report_interval: Mapped[float] = mapped_column(Float, nullable=False, server_default="30.0")
    tasmota_host: Mapped[str | None] = mapped_column(String, nullable=True)
    tasmota_topic: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    printer_type: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    print_check_status: Mapped[str | None] = mapped_column(String, nullable=True, default="clear")
    print_time_total_seconds: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    print_time_today_seconds: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    print_time_today_date: Mapped[str | None] = mapped_column(String, nullable=True)
    print_time_last_elapsed: Mapped[float | None] = mapped_column(Float, nullable=True)
    print_time_last_job_name: Mapped[str | None] = mapped_column(String, nullable=True)
