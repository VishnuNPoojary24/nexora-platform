import { NotFoundError } from "../errors/app-error.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { CreateUserInput, UpdateUserInput, UserListQuery } from "../validation/user.validation.js";

export class UserService {
  constructor(private readonly users: UserRepository) {}

  list(query: UserListQuery) {
    return this.users.list(query);
  }

  async get(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("USER_NOT_FOUND", "User was not found");
    return user;
  }

  create(input: CreateUserInput) {
    return this.users.create(input);
  }

  async update(id: string, input: UpdateUserInput) {
    const user = await this.users.update(id, input);
    if (!user) throw new NotFoundError("USER_NOT_FOUND", "User was not found");
    return user;
  }
}
