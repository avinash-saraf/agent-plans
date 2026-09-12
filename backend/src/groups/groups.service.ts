import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningService } from '../planning/planning.service';
import { MemberDto, CreateGroupDto } from './group.dto';
import { Member, PlanRun, SharedGroup } from './group.types';

const json = (value: unknown) => value as Prisma.InputJsonValue;
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: PlanningService,
  ) {}
  async get(slug: string): Promise<SharedGroup> {
    const group = await this.prisma.group.findUnique({ where: { slug } });
    if (!group)
      throw new NotFoundException('This group hasn’t been created yet.');
    let run = group.run as unknown as PlanRun | null;
    if (
      run?.status === 'running' &&
      Date.now() - Date.parse(run.startedAt) >= 420000
    )
      run = {
        ...run,
        status: 'failed',
        error: 'This round was interrupted. You can make a new plan.',
      };
    return {
      slug: group.slug,
      city: group.city,
      members: group.members as unknown as Member[],
      revision: group.revision,
      run,
    };
  }
  async create(input: CreateGroupDto) {
    try {
      await this.prisma.group.create({ data: input });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'That group link is already taken. Choose another, or open the existing group.',
        );
      throw e;
    }
    return this.get(input.slug);
  }
  private async editable(slug: string, revision: number) {
    const group = await this.get(slug);
    if (group.revision !== revision)
      throw new ConflictException(
        'The group changed. Refresh it before saving again.',
      );
    if (
      group.run?.status === 'running' &&
      Date.now() - Date.parse(group.run.startedAt) < 420000
    )
      throw new ConflictException(
        'A plan is already running. Wait for it to finish.',
      );
    return group;
  }
  private async update(
    group: SharedGroup,
    data: Prisma.GroupUpdateManyMutationInput,
  ) {
    const result = await this.prisma.group.updateMany({
      where: { slug: group.slug, revision: group.revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException(
        'The group changed. Refresh it before saving again.',
      );
    return this.get(group.slug);
  }
  async city(slug: string, revision: number, city: string) {
    return this.update(await this.editable(slug, revision), {
      city,
      run: Prisma.DbNull,
    });
  }
  async member(slug: string, input: MemberDto, id?: string) {
    const group = await this.editable(slug, input.revision);
    if (id && !group.members.some((m) => m.id === id))
      throw new NotFoundException('This person is no longer in the group.');
    if (!id && group.members.length >= 4)
      throw new ConflictException('All four seats are filled.');
    const member = {
      id: id || randomUUID(),
      name: input.name,
      context: input.context,
    };
    const members = id
      ? group.members.map((m) => (m.id === id ? member : m))
      : [...group.members, member];
    return this.update(group, { members: json(members), run: Prisma.DbNull });
  }
  async remove(slug: string, revision: number, id: string) {
    const group = await this.editable(slug, revision);
    if (!group.members.some((m) => m.id === id))
      throw new NotFoundException('This person is no longer in the group.');
    return this.update(group, {
      members: json(group.members.filter((m) => m.id !== id)),
      run: Prisma.DbNull,
    });
  }
  async plan(slug: string, revision: number) {
    if (!this.planner.status().ready)
      throw new BadRequestException(
        'Live planning needs its search and AI services configured.',
      );
    const group = await this.editable(slug, revision);
    if (group.members.length !== 4)
      throw new BadRequestException(
        'Bring four people into the group to make a plan.',
      );
    const run: PlanRun = {
      id: randomUUID(),
      status: 'running',
      startedAt: new Date().toISOString(),
      transcript: [],
    };
    const started = await this.update(group, { run: json(run) });
    const persist = () =>
      this.prisma.group.updateMany({
        where: { slug, revision: started.revision },
        data: { run: json(run) },
      });
    try {
      run.result = await this.planner.run(
        group.city,
        group.members,
        async (turns) => {
          run.transcript = turns;
          await persist();
        },
      );
      run.status = 'complete';
      await persist();
    } catch (e) {
      run.status = 'failed';
      run.error =
        e instanceof Error
          ? e.message
          : 'Couldn’t finish the plan. Please try again.';
      await persist();
    }
    return this.get(slug);
  }
}
