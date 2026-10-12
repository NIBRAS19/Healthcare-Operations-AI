import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Overview from "./pages/Overview.jsx";
import { Queue, Cases } from "./pages/Lists.jsx";
import NewCase from "./pages/NewCase.jsx";
import CaseWorkspace from "./pages/CaseWorkspace.jsx";
import { Documents, DocumentReview } from "./pages/Documents.jsx";
import { Tasks, Reports, Audit } from "./pages/Operations.jsx";
import { Integrations, Users, Workflows, Profile, Help, SystemStatus } from "./pages/Admin.jsx";

function Protected({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  return user ? children : <Navigate to="/login" state={{ from: loc }} replace />;
}
function Guard({ area, children }) {
  const { can } = useAuth();
  return can(area) ? children : (
    <div className="card" role="alert"><h2>You don't have access to this page</h2><p className="muted">Ask your administrator to review your role.</p></div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/app/overview" replace />} />
      <Route path="/app" element={<Protected><Layout /></Protected>}>
        <Route path="overview" element={<Overview />} />
        <Route path="queue" element={<Queue />} />
        <Route path="cases" element={<Cases />} />
        <Route path="cases/new" element={<NewCase />} />
        <Route path="cases/:id" element={<CaseWorkspace />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/:id" element={<DocumentReview />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit" element={<Guard area="audit"><Audit /></Guard>} />
        <Route path="integrations" element={<Guard area="integrations"><Integrations /></Guard>} />
        <Route path="settings/users" element={<Guard area="settings"><Users /></Guard>} />
        <Route path="settings/workflows" element={<Guard area="settings"><Workflows /></Guard>} />
        <Route path="settings/profile" element={<Profile />} />
        <Route path="help" element={<Help />} />
        <Route path="system-status" element={<SystemStatus />} />
        <Route path="*" element={<div className="card"><h2>Page not found</h2></div>} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
