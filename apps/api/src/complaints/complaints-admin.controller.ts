import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { StaffJwtGuard, StaffRoles, StaffRolesGuard, type StaffContext } from '../auth/staff-jwt.guard';
import { ComplaintsService } from './complaints.service';

interface StaffReq {
  staff: StaffContext;
}

@Controller('api/admin/complaints')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
export class ComplaintsAdminController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  @StaffRoles('administrator', 'super_admin')
  list(@Req() req: StaffReq) {
    return this.complaints.list({
      staffId: req.staff.staffId,
      email: req.staff.email,
      role: req.staff.role,
    });
  }

  @Post(':id/resolve')
  @StaffRoles('administrator', 'super_admin')
  resolve(
    @Param('id') id: string,
    @Body() body: { decision: 'resolve' | 'reject'; resolutionNote?: string },
    @Req() req: StaffReq,
  ) {
    return this.complaints.resolve(
      { staffId: req.staff.staffId, email: req.staff.email, role: req.staff.role },
      id,
      body.decision,
      body.resolutionNote ?? '',
    );
  }
}
