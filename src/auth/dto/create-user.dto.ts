import { User } from "../../user/dto/user.dto";
import { PickType } from "@nestjs/mapped-types";

export class CreateUser extends PickType(User, ['email', 'username', 'password'] as const) { }
export class LoginUser extends PickType(User, ['email', 'password', 'id'] as const) { }