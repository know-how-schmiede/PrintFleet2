from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from printfleet2.db.base import Base


class PrinterGroup(Base):
    __tablename__ = "printer_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    printer_type: Mapped[str | None] = mapped_column(String, nullable=True)
