import { IsEmail, MinLength } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class User {
    id: string

    @IsEmail()
    email: string

    @MinLength(3)
    username: string

    @MinLength(6)
    password: string

    role?: string

}

export class UpdateUser extends PartialType(User) { }