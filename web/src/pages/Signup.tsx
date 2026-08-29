import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api';
import { useAuth } from '../auth';

const Signup = () => {
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }

        setSubmitting(true);
        try {
            await signup(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="page-center">
            <div className="auth-card">
                <h1>Create your account</h1>
                <p className="muted">Sign up to get an API key for the AsyncAPI MCP server.</p>
                <form onSubmit={onSubmit} className="auth-form">
                    <label>
                        Email
                        <input
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            required
                            minLength={8}
                            autoComplete="new-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                        />
                    </label>
                    <label>
                        Confirm password
                        <input
                            type="password"
                            required
                            minLength={8}
                            autoComplete="new-password"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            placeholder="Repeat your password"
                        />
                    </label>
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                        {submitting ? 'Creating account…' : 'Sign up'}
                    </button>
                </form>
                <p className="muted auth-switch">
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
