import React from 'react';
import type { AIStatus } from '../hooks/usePromptAPI';

interface StatusBannerProps {
    status: AIStatus;
    error: string | null;
    downloadProgress?: number;
}

const StatusBanner: React.FC<StatusBannerProps> = ({ status, error, downloadProgress }) => {
    const getPill = () => {
        switch (status) {
            case 'ready':
                return <span className="status-pill status-ready">● Model Ready</span>;
            case 'loading':
                return (
                    <span className="status-pill status-loading">
                        ○ Downloading Model ({downloadProgress || 0}%)
                    </span>
                );
            case 'checking':
                return <span className="status-pill status-loading">○ checking AI Availability...</span>;
            case 'unsupported':
                return (
                    <span className="status-pill status-error">
                        ✕ Unsupported Browser. Use Chrome 129+
                    </span>
                );
            case 'unavailable':
                return <span className="status-pill status-error">✕ AI Unavailable: {error}</span>;
            default:
                return null;
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getPill()}
        </div>
    );
};

export default StatusBanner;
