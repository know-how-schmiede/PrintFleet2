from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from printfleet2.db.base import Base


class PrinterType(Base):
    __tablename__ = "printer_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    bed_size: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    manufacturer: Mapped[str | None] = mapped_column(String, nullable=True)
    upload_gcode_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    type_kind: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
