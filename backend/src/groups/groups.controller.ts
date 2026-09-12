import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CityDto, CreateGroupDto, MemberDto, RevisionDto } from './group.dto';
import { PlanningService } from '../planning/planning.service';

@Controller()
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly planner: PlanningService,
  ) {}
  @Get('planning/status') status() {
    return this.planner.status();
  }
  @Post('groups') create(@Body() body: CreateGroupDto) {
    return this.groups.create(body);
  }
  @Get('groups/:slug') get(@Param('slug') slug: string) {
    return this.groups.get(slug);
  }
  @Patch('groups/:slug') city(
    @Param('slug') slug: string,
    @Body() body: CityDto,
  ) {
    return this.groups.city(slug, body.revision, body.city);
  }
  @Post('groups/:slug/members') add(
    @Param('slug') slug: string,
    @Body() body: MemberDto,
  ) {
    return this.groups.member(slug, body);
  }
  @Patch('groups/:slug/members/:id') edit(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: MemberDto,
  ) {
    return this.groups.member(slug, body, id);
  }
  @Delete('groups/:slug/members/:id') remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: RevisionDto,
  ) {
    return this.groups.remove(slug, body.revision, id);
  }
  @Post('groups/:slug/plan') @HttpCode(200) plan(
    @Param('slug') slug: string,
    @Body() body: RevisionDto,
  ) {
    return this.groups.plan(slug, body.revision);
  }
}
