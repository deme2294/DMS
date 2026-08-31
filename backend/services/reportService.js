import * as reportRepo from '../repository/reportRepository.js';

const getManagerDeptIds = async (user) => {
  if (user?.role === 'manager') {
    return reportRepo.getManagerDepartmentIds(user.id);
  }
  return null;
};

export const getTicketReports = async (filters, user) => {
  const managerDeptIds = await getManagerDeptIds(user);
  return reportRepo.getTicketReports(filters, managerDeptIds);
};

export const getDepartmentReports = async (filters, user) => {
  const managerDeptIds = await getManagerDeptIds(user);
  return reportRepo.getDepartmentReports(filters, managerDeptIds);
};

export const getStaffReports = async (filters, user) => {
  const managerDeptIds = await getManagerDeptIds(user);
  return reportRepo.getStaffReports(filters, managerDeptIds);
};

export const getTenantReports = async (filters, user) => {
  const managerDeptIds = await getManagerDeptIds(user);
  return reportRepo.getTenantReports(filters, managerDeptIds);
};

