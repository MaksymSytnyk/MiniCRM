from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Annotated
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    AwareDatetime,
    StringConstraints,
)

Name = Annotated[str, Field(min_length=1, max_length=120)]
Password = Annotated[str, StringConstraints(strip_whitespace=False, max_length=128)]
Money = Annotated[
    Decimal, Field(ge=0, le=999999999999, max_digits=14, decimal_places=2)
]
LeadStatus = Literal["New", "Contacted", "Qualified", "Converted", "Lost"]
DealStatus = Literal["Open", "In Progress", "Won", "Lost"]
TaskStatus = Literal["Pending", "In Progress", "Completed"]


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class Register(Input):
    full_name: Name
    email: EmailStr
    password: Password = Field(min_length=10, max_length=128)


class Login(Input):
    email: EmailStr
    password: Password = Field(min_length=1, max_length=128)


class Profile(Input):
    full_name: Name
    company: str = Field(default="", max_length=200)
    theme: Literal["dark", "light", "system"] = "dark"


class PasswordChange(Input):
    current_password: Password
    new_password: Password = Field(min_length=10, max_length=128)


class DeleteAccount(Input):
    password: Password


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    company: str
    theme: str


class ClientIn(Input):
    full_name: Name
    email: EmailStr | None = None
    phone: str = Field(default="", max_length=40)
    company: str = Field(default="", max_length=200)
    tags: list[Annotated[str, Field(min_length=1, max_length=40)]] = Field(
        default_factory=list, max_length=20
    )
    notes: str = Field(default="", max_length=10000)
    last_interaction_at: AwareDatetime | None = None


class LeadIn(Input):
    name: Name
    email: EmailStr | None = None
    phone: str = Field(default="", max_length=40)
    company: str = Field(default="", max_length=200)
    source: str = Field(default="", max_length=100)
    status: LeadStatus = "New"
    estimated_value: Money = Decimal("0")
    notes: str = Field(default="", max_length=10000)


class DealIn(Input):
    title: str = Field(min_length=1, max_length=200)
    client_id: str | None = Field(default=None, max_length=36)
    value: Money = Decimal("0")
    status: DealStatus = "Open"
    expected_close_date: date | None = None
    description: str = Field(default="", max_length=10000)


class TaskIn(Input):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10000)
    due_date: date | None = None
    priority: Literal["Low", "Medium", "High"] = "Medium"
    status: TaskStatus = "Pending"
    client_id: str | None = Field(default=None, max_length=36)
    deal_id: str | None = Field(default=None, max_length=36)


class StatusIn(Input):
    status: str
