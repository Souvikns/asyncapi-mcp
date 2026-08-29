import { Route, Routes } from 'react-router-dom';

import Landing from './pages/Landing';

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

const Nav = () => (
    <header className="nav">
        <a href="/" className="nav-brand">
            <SpikeMark /> AsyncAPI MCP
        </a>
        <nav className="nav-links">
            <a
                href="https://github.com/Souvikns/asyncapi-mcp"
                className="nav-link"
                target="_blank"
                rel="noreferrer"
            >
                GitHub
            </a>
        </nav>
    </header>
);

const App = () => (
    <div className="app">
        <Nav />
        <main>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="*" element={<Landing />} />
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
