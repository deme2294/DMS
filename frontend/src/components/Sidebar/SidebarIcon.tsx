import React from 'react';
import {
  Squares2X2Icon,
  ChartBarSquareIcon,
  CheckBadgeIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  TableCellsIcon,
  TicketIcon,
  PlusCircleIcon,
  TagIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  MegaphoneIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  FolderIcon,
  PresentationChartLineIcon,
  DocumentTextIcon,
  HandThumbUpIcon,
  DocumentChartBarIcon,
  ShieldExclamationIcon,
  UserCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface SidebarIconProps {
  label: string;
  path: string;
  className?: string;
}

export const SidebarIcon: React.FC<SidebarIconProps> = ({ label, path, className = '' }) => {
  const normLabel = label.toLowerCase();
  const normPath = path.toLowerCase();

  if (normPath.includes('dashboard') || normLabel.includes('dashboard')) {
    return <Squares2X2Icon className={className} />;
  }
  if (normPath.includes('analytics') || normLabel.includes('analytics')) {
    return <ChartBarSquareIcon className={className} />;
  }
  if (normPath.includes('approvals') || normLabel.includes('approval')) {
    return <CheckBadgeIcon className={className} />;
  }
  if (normPath.includes('users') || normLabel.includes('users')) {
    return <UserGroupIcon className={className} />;
  }
  if (normPath.includes('tenants') || normLabel.includes('tenants')) {
    return <BuildingOffice2Icon className={className} />;
  }
  if (normPath.includes('departments') || normLabel.includes('departments')) {
    return <BuildingOfficeIcon className={className} />;
  }
  if (normPath.includes('matrix') || normLabel.includes('matrix')) {
    return <TableCellsIcon className={className} />;
  }
  if (normPath.includes('create') && normLabel.includes('ticket')) {
    return <PlusCircleIcon className={className} />;
  }
  if (normPath.includes('ticket-categories') || normLabel.includes('ticket categories')) {
    return <TagIcon className={className} />;
  }
  if (normPath.includes('sla') || normLabel.includes('sla')) {
    return <ClockIcon className={className} />;
  }
  if (normPath.includes('tickets') || normLabel.includes('ticket')) {
    return <TicketIcon className={className} />;
  }
  if (normPath.includes('chat') || normLabel.includes('chat')) {
    return <ChatBubbleLeftRightIcon className={className} />;
  }
  if (normPath.includes('notifications') || normLabel.includes('notification')) {
    return <BellIcon className={className} />;
  }
  if (normPath.includes('notices') || normLabel.includes('notice')) {
    return <MegaphoneIcon className={className} />;
  }
  if (normPath.includes('my-articles') || normLabel.includes('my article')) {
    return <DocumentTextIcon className={className} />;
  }
  if (normPath.includes('categories') && normPath.includes('knowledge')) {
    return <FolderIcon className={className} />;
  }
  if (normPath.includes('statistics') && normPath.includes('knowledge')) {
    return <PresentationChartLineIcon className={className} />;
  }
  if (normPath.includes('approval') && normPath.includes('knowledge')) {
    return <ShieldCheckIcon className={className} />;
  }
  if (normPath.includes('knowledge') || normLabel.includes('knowledge')) {
    return <BookOpenIcon className={className} />;
  }
  if (normPath.includes('feedback') || normLabel.includes('feedback')) {
    return <HandThumbUpIcon className={className} />;
  }
  if (normPath.includes('reports') || normLabel.includes('report')) {
    return <DocumentChartBarIcon className={className} />;
  }
  if (normPath.includes('audit') || normLabel.includes('audit')) {
    return <ShieldExclamationIcon className={className} />;
  }
  if (normPath.includes('profile') || normLabel.includes('profile')) {
    return <UserCircleIcon className={className} />;
  }

  return <SparklesIcon className={className} />;
};
