import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import CeoLayout from './layouts/CeoLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Authentication/Login';
import TicketList from './pages/Tickets/TicketList';
import TicketCreate from './pages/Tickets/TicketCreate';
import TicketDetail from './pages/Tickets/TicketDetail';
import TrackTicket from './pages/Tickets/TrackTicket';
import TenantList from './pages/Tenants/TenantList';
import TenantCreate from './pages/Tenants/TenantCreate';
import TenantDetail from './pages/Tenants/TenantDetail';
import TenantEdit from './pages/Tenants/TenantEdit';
import UserList from './pages/Users/UserList';
import UserCreate from './pages/Users/UserCreate';
import UserEdit from './pages/Users/UserEdit';
import DepartmentList from './pages/Departments/DepartmentList';
import DepartmentCreate from './pages/Departments/DepartmentCreate';
import DepartmentEdit from './pages/Departments/DepartmentEdit';
import MatrixView from './pages/Matrix/MatrixView';
import ManagerDepartmentList from './pages/Departments/ManagerDepartmentList';
import ManagerDepartmentCreate from './pages/Departments/ManagerDepartmentCreate';
import ManagerDepartmentEdit from './pages/Departments/ManagerDepartmentEdit';
import ManagerMatrixView from './pages/Matrix/ManagerMatrixView';
import NoticesList from './pages/Notices/NoticesList';
import NoticesCreate from './pages/Notices/NoticesCreate';
import NoticesEdit from './pages/Notices/NoticesEdit';
import KnowledgeList from './pages/Knowledge/KnowledgeList';
import KnowledgeCreate from './pages/Knowledge/KnowledgeCreate';
import KnowledgeEdit from './pages/Knowledge/KnowledgeEdit';
import KnowledgeArticleView from './pages/Knowledge/KnowledgeArticleView';
import KnowledgeApproval from './pages/Knowledge/KnowledgeApproval';
import KnowledgeCategories from './pages/Knowledge/KnowledgeCategories';
import KnowledgeVersions from './pages/Knowledge/KnowledgeVersions';
import KnowledgeMyArticles from './pages/Knowledge/KnowledgeMyArticles';
import KnowledgeStatistics from './pages/Knowledge/KnowledgeStatistics';
import FeedbackList from './pages/Feedback/FeedbackList';
import FeedbackDetail from './pages/Feedback/FeedbackDetail';
import FeedbackCreate from './pages/Feedback/FeedbackCreate';
import Reports from './pages/Reports/Reports';
import Audit from './pages/Audit/Audit';
import TicketCategories from './pages/TicketCategories/TicketCategories';
import AdminDashboard from './pages/Dashboard/AdminDashboard';
import AdminAnalytics from './pages/Analytics/AdminAnalytics';
import ManagerDashboard from './pages/Dashboard/ManagerDashboard';
import StaffDashboard from './pages/Dashboard/StaffDashboard';
import TenantDashboard from './pages/Dashboard/TenantDashboard';
import SLAPolicies from './pages/Dashboard/SLAPolicies';
import CeoDashboard from './pages/Dashboard/CeoDashboard';
import CeoAnalytics from './pages/Dashboard/CeoAnalytics';
import CeoApprovals from './pages/Dashboard/CeoApprovals';
import CeoUserList from './pages/Users/CeoUserList';
import CeoUserCreate from './pages/Users/CeoUserCreate';
import CeoUserEdit from './pages/Users/CeoUserEdit';
import CeoTenantList from './pages/Tenants/CeoTenantList';
import CeoTenantCreate from './pages/Tenants/CeoTenantCreate';
import CeoTenantDetail from './pages/Tenants/CeoTenantDetail';
import CeoTenantEdit from './pages/Tenants/CeoTenantEdit';
import CeoDepartmentList from './pages/Departments/CeoDepartmentList';
import CeoDepartmentCreate from './pages/Departments/CeoDepartmentCreate';
import CeoDepartmentEdit from './pages/Departments/CeoDepartmentEdit';
import CeoTicketList from './pages/Tickets/CeoTicketList';
import CeoTicketDetail from './pages/Tickets/CeoTicketDetail';
import CeoReports from './pages/Reports/CeoReports';
import CeoKnowledgeList from './pages/Knowledge/CeoKnowledgeList';
import CeoKnowledgeCreate from './pages/Knowledge/CeoKnowledgeCreate';
import CeoKnowledgeEdit from './pages/Knowledge/CeoKnowledgeEdit';
import CeoNoticesList from './pages/Notices/CeoNoticesList';
import CeoNoticesCreate from './pages/Notices/CeoNoticesCreate';
import CeoNoticesEdit from './pages/Notices/CeoNoticesEdit';
import CeoAudit from './pages/Audit/CeoAudit';
import MyProfile from './pages/Profiles/MyProfile';
import ChatPage from './pages/Chat/ChatPage';
import StaffNotices from './pages/Notices/StaffNotices';
import ManagerNotices from './pages/Notices/ManagerNotices';
import TenantNotices from './pages/Notices/TenantNotices';
import NotificationsPage from './pages/Notifications/NotificationsPage';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SocketProvider>
          <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<CeoLayout />}>
          <Route path="/ceo/dashboard" element={<ProtectedRoute roles={['ceo']}><CeoDashboard /></ProtectedRoute>} />
          <Route path="/ceo/analytics" element={<ProtectedRoute roles={['ceo']}><CeoAnalytics /></ProtectedRoute>} />
          <Route path="/ceo/approvals" element={<ProtectedRoute roles={['ceo']}><CeoApprovals /></ProtectedRoute>} />
          <Route path="/ceo/users" element={<ProtectedRoute roles={['ceo']}><CeoUserList /></ProtectedRoute>} />
          <Route path="/ceo/users/create" element={<ProtectedRoute roles={['ceo']}><CeoUserCreate /></ProtectedRoute>} />
          <Route path="/ceo/users/:id/edit" element={<ProtectedRoute roles={['ceo']}><CeoUserEdit /></ProtectedRoute>} />
          <Route path="/ceo/tenants" element={<ProtectedRoute roles={['ceo']}><CeoTenantList /></ProtectedRoute>} />
          <Route path="/ceo/tenants/create" element={<ProtectedRoute roles={['ceo']}><CeoTenantCreate /></ProtectedRoute>} />
          <Route path="/ceo/tenants/:id" element={<ProtectedRoute roles={['ceo']}><CeoTenantDetail /></ProtectedRoute>} />
          <Route path="/ceo/tenants/:id/edit" element={<ProtectedRoute roles={['ceo']}><CeoTenantEdit /></ProtectedRoute>} />
          <Route path="/ceo/departments" element={<ProtectedRoute roles={['ceo']}><CeoDepartmentList /></ProtectedRoute>} />
          <Route path="/ceo/departments/create" element={<ProtectedRoute roles={['ceo']}><CeoDepartmentCreate /></ProtectedRoute>} />
          <Route path="/ceo/departments/:id/edit" element={<ProtectedRoute roles={['ceo']}><CeoDepartmentEdit /></ProtectedRoute>} />
          <Route path="/ceo/tickets" element={<ProtectedRoute roles={['ceo']}><CeoTicketList /></ProtectedRoute>} />
          <Route path="/ceo/tickets/:id" element={<ProtectedRoute roles={['ceo']}><CeoTicketDetail /></ProtectedRoute>} />
          <Route path="/ceo/reports" element={<ProtectedRoute roles={['ceo']}><CeoReports /></ProtectedRoute>} />
          <Route path="/ceo/knowledge" element={<ProtectedRoute roles={['ceo']}><CeoKnowledgeList /></ProtectedRoute>} />
          <Route path="/ceo/knowledge/create" element={<ProtectedRoute roles={['ceo']}><CeoKnowledgeCreate /></ProtectedRoute>} />
          <Route path="/ceo/knowledge/:id/edit" element={<ProtectedRoute roles={['ceo']}><CeoKnowledgeEdit /></ProtectedRoute>} />
          <Route path="/ceo/notices" element={<ProtectedRoute roles={['ceo']}><CeoNoticesList /></ProtectedRoute>} />
          <Route path="/ceo/notices/create" element={<ProtectedRoute roles={['ceo']}><CeoNoticesCreate /></ProtectedRoute>} />
          <Route path="/ceo/notices/:id/edit" element={<ProtectedRoute roles={['ceo']}><CeoNoticesEdit /></ProtectedRoute>} />
          <Route path="/ceo/audit" element={<ProtectedRoute roles={['ceo']}><CeoAudit /></ProtectedRoute>} />
          <Route path="/ceo/chat" element={<ProtectedRoute roles={['ceo']}><ChatPage /></ProtectedRoute>} />
          <Route path="/ceo/notifications" element={<ProtectedRoute roles={['ceo']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/ceo/profile" element={<ProtectedRoute roles={['ceo']}><MyProfile /></ProtectedRoute>} />
        </Route>

        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin', 'manager']}><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UserList /></ProtectedRoute>} />
          <Route path="/admin/users/create" element={<ProtectedRoute roles={['admin']}><UserCreate /></ProtectedRoute>} />
          <Route path="/admin/users/:id/edit" element={<ProtectedRoute roles={['admin']}><UserEdit /></ProtectedRoute>} />
          <Route path="/admin/tenants" element={<ProtectedRoute roles={['admin']}><TenantList /></ProtectedRoute>} />
          <Route path="/admin/tenants/create" element={<ProtectedRoute roles={['admin']}><TenantCreate /></ProtectedRoute>} />
          <Route path="/admin/tenants/:id" element={<ProtectedRoute roles={['admin']}><TenantDetail /></ProtectedRoute>} />
          <Route path="/admin/tenants/:id/edit" element={<ProtectedRoute roles={['admin']}><TenantEdit /></ProtectedRoute>} />
          <Route path="/admin/departments" element={<ProtectedRoute roles={['admin', 'manager']}><DepartmentList /></ProtectedRoute>} />
          <Route path="/admin/departments/create" element={<ProtectedRoute roles={['admin', 'manager']}><DepartmentCreate /></ProtectedRoute>} />
          <Route path="/admin/departments/:id/edit" element={<ProtectedRoute roles={['admin', 'manager']}><DepartmentEdit /></ProtectedRoute>} />
          <Route path="/admin/matrix" element={<ProtectedRoute roles={['admin', 'manager']}><MatrixView /></ProtectedRoute>} />
          <Route path="/admin/tickets" element={<ProtectedRoute roles={['admin']}><TicketList /></ProtectedRoute>} />
          <Route path="/admin/tickets/:id" element={<ProtectedRoute roles={['admin']}><TicketDetail /></ProtectedRoute>} />
          <Route path="/admin/notices" element={<ProtectedRoute roles={['admin']}><NoticesList /></ProtectedRoute>} />
          <Route path="/admin/notices/create" element={<ProtectedRoute roles={['admin']}><NoticesCreate /></ProtectedRoute>} />
          <Route path="/admin/notices/:id/edit" element={<ProtectedRoute roles={['admin']}><NoticesEdit /></ProtectedRoute>} />
          <Route path="/admin/knowledge" element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><KnowledgeList /></ProtectedRoute>} />
          <Route path="/admin/knowledge/create" element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><KnowledgeCreate /></ProtectedRoute>} />
          <Route path="/admin/knowledge/approval" element={<ProtectedRoute roles={['admin', 'manager']}><KnowledgeApproval /></ProtectedRoute>} />
          <Route path="/admin/knowledge/categories" element={<ProtectedRoute roles={['admin']}><KnowledgeCategories /></ProtectedRoute>} />
          <Route path="/admin/knowledge/statistics" element={<ProtectedRoute roles={['admin']}><KnowledgeStatistics /></ProtectedRoute>} />
          <Route path="/admin/knowledge/my-articles" element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><KnowledgeMyArticles /></ProtectedRoute>} />
          <Route path="/admin/knowledge/:id/edit" element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><KnowledgeEdit /></ProtectedRoute>} />
          <Route path="/admin/knowledge/:id/versions" element={<ProtectedRoute roles={['admin', 'manager']}><KnowledgeVersions /></ProtectedRoute>} />
          <Route path="/admin/knowledge/:id" element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><KnowledgeArticleView /></ProtectedRoute>} />
          <Route path="/admin/feedback" element={<ProtectedRoute roles={['admin']}><FeedbackList /></ProtectedRoute>} />
          <Route path="/admin/feedback/:id" element={<ProtectedRoute roles={['admin']}><FeedbackDetail /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute roles={['admin']}><Audit /></ProtectedRoute>} />
          <Route path="/admin/ticket-categories" element={<ProtectedRoute roles={['admin', 'manager']}><TicketCategories /></ProtectedRoute>} />
          <Route path="/admin/sla" element={<ProtectedRoute roles={['admin', 'ceo']}><SLAPolicies /></ProtectedRoute>} />
          <Route path="/admin/chat" element={<ProtectedRoute roles={['admin']}><ChatPage /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute roles={['admin']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']}><MyProfile /></ProtectedRoute>} />

          <Route path="/manager/dashboard" element={<ProtectedRoute roles={['manager']}><ManagerDashboard /></ProtectedRoute>} />
          <Route path="/manager/departments" element={<ProtectedRoute roles={['manager']}><ManagerDepartmentList /></ProtectedRoute>} />
          <Route path="/manager/departments/:id/edit" element={<ProtectedRoute roles={['manager']}><ManagerDepartmentEdit /></ProtectedRoute>} />
          <Route path="/manager/matrix" element={<ProtectedRoute roles={['manager']}><ManagerMatrixView /></ProtectedRoute>} />
          <Route path="/manager/tickets" element={<ProtectedRoute roles={['manager']}><TicketList /></ProtectedRoute>} />
          <Route path="/manager/tickets/:id" element={<ProtectedRoute roles={['manager']}><TicketDetail /></ProtectedRoute>} />
          <Route path="/manager/ticket-categories" element={<ProtectedRoute roles={['admin', 'manager']}><TicketCategories /></ProtectedRoute>} />
          <Route path="/manager/notices" element={<ProtectedRoute roles={['manager']}><ManagerNotices /></ProtectedRoute>} />
          <Route path="/manager/knowledge" element={<ProtectedRoute roles={['manager']}><KnowledgeList /></ProtectedRoute>} />
          <Route path="/manager/knowledge/create" element={<ProtectedRoute roles={['manager']}><KnowledgeCreate /></ProtectedRoute>} />
          <Route path="/manager/knowledge/approval" element={<ProtectedRoute roles={['manager']}><KnowledgeApproval /></ProtectedRoute>} />
          <Route path="/manager/knowledge/my-articles" element={<ProtectedRoute roles={['manager']}><KnowledgeMyArticles /></ProtectedRoute>} />
          <Route path="/manager/knowledge/:id/edit" element={<ProtectedRoute roles={['manager']}><KnowledgeEdit /></ProtectedRoute>} />
          <Route path="/manager/knowledge/:id/versions" element={<ProtectedRoute roles={['manager']}><KnowledgeVersions /></ProtectedRoute>} />
          <Route path="/manager/knowledge/:id" element={<ProtectedRoute roles={['manager']}><KnowledgeArticleView /></ProtectedRoute>} />
          <Route path="/manager/reports" element={<ProtectedRoute roles={['manager']}><Reports /></ProtectedRoute>} />
          <Route path="/manager/chat" element={<ProtectedRoute roles={['manager']}><ChatPage /></ProtectedRoute>} />
          <Route path="/manager/notifications" element={<ProtectedRoute roles={['manager']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/manager/profile" element={<ProtectedRoute roles={['manager']}><MyProfile /></ProtectedRoute>} />

          <Route path="/staff/dashboard" element={<ProtectedRoute roles={['staff']}><StaffDashboard /></ProtectedRoute>} />
          <Route path="/staff/tickets" element={<ProtectedRoute roles={['staff']}><TicketList /></ProtectedRoute>} />
          <Route path="/staff/tickets/:id" element={<ProtectedRoute roles={['staff']}><TicketDetail /></ProtectedRoute>} />
          <Route path="/staff/notices" element={<ProtectedRoute roles={['staff']}><StaffNotices /></ProtectedRoute>} />
          <Route path="/staff/chat" element={<ProtectedRoute roles={['staff']}><ChatPage /></ProtectedRoute>} />
          <Route path="/staff/notifications" element={<ProtectedRoute roles={['staff']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/staff/profile" element={<ProtectedRoute roles={['staff']}><MyProfile /></ProtectedRoute>} />

          <Route path="/tenant/dashboard" element={<ProtectedRoute roles={['tenant']}><TenantDashboard /></ProtectedRoute>} />
          <Route path="/tenant/tickets" element={<ProtectedRoute roles={['tenant']}><TicketList /></ProtectedRoute>} />
          <Route path="/tenant/tickets/create" element={<ProtectedRoute roles={['tenant']}><TicketCreate /></ProtectedRoute>} />
          <Route path="/tenant/tickets/:id" element={<ProtectedRoute roles={['tenant']}><TicketDetail /></ProtectedRoute>} />
          <Route path="/tenant/knowledge" element={<ProtectedRoute roles={['tenant']}><KnowledgeList /></ProtectedRoute>} />
          <Route path="/tenant/feedback" element={<ProtectedRoute roles={['tenant']}><FeedbackList /></ProtectedRoute>} />
          <Route path="/tenant/feedback/create" element={<ProtectedRoute roles={['tenant']}><FeedbackCreate /></ProtectedRoute>} />
          <Route path="/tenant/notices" element={<ProtectedRoute roles={['tenant']}><TenantNotices /></ProtectedRoute>} />
          <Route path="/tenant/chat" element={<ProtectedRoute roles={['tenant']}><ChatPage /></ProtectedRoute>} />
          <Route path="/tenant/notifications" element={<ProtectedRoute roles={['tenant']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/tenant/profile" element={<ProtectedRoute roles={['tenant']}><MyProfile /></ProtectedRoute>} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/track" element={<TrackTicket />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Route>
        </Routes>
        </SocketProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
