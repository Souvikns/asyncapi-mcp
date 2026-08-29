import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from './auth';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="page-center">
                <p className="muted">Loading…</p>
            </div>
        );
    }
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

const SpikeMark = () => (
    <span className="nav-mark" aria-hidden="true">
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
        >
            <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" />
        </svg>
    </span>
);

const Nav = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <header className="nav">
            <Link to="/" className="nav-brand">
                <SpikeMark /> AsyncAPI MCP
            </Link>
            <nav className="nav-links">
                {user ? (
                    <>
                        <Link to="/dashboard" className="nav-link">
                            Dashboard
                        </Link>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="nav-link">
                            Log in
                        </Link>
                        <Link to="/signup" className="btn btn-primary btn-sm">
                            Get an API key
                        </Link>
                    </>
                )}
            </nav>
        </header>
    );
};

const App = () => (
    <div className="app">
        <Nav />
        <main>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </main>
        <footer className="footer">
            <div className="footer-inner">
                <div>
                    <span className="footer-brand">
                        <SpikeMark /> AsyncAPI MCP
                    </span>
                    <p>Open source under the MIT license.</p>
                </div>
                <nav className="footer-links">
                    <a href="https://github.com/asyncapi/spec" target="_blank" rel="noreferrer">
                        AsyncAPI Specification
                    </a>
                    <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
                        Model Context Protocol
                    </a>
                </nav>
            </div>
        </footer>
    </div>
);

export default App;
