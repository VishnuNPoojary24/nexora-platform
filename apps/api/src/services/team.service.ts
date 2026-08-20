import { NotFoundError } from "../errors/app-error.js";
import type { TeamRepository } from "../repositories/team.repository.js";
import type { CreateTeamInput, TeamListQuery, UpdateTeamInput } from "../validation/team.validation.js";

export class TeamService {
  constructor(private readonly teams: TeamRepository) {}

  list(query: TeamListQuery) {
    return this.teams.list(query);
  }

  async get(id: string) {
    const team = await this.teams.findById(id);
    if (!team) throw new NotFoundError("TEAM_NOT_FOUND", "Team was not found");
    return team;
  }

  create(input: CreateTeamInput) {
    return this.teams.create(input);
  }

  async update(id: string, input: UpdateTeamInput) {
    const team = await this.teams.update(id, input);
    if (!team) throw new NotFoundError("TEAM_NOT_FOUND", "Team was not found");
    return team;
  }
}
