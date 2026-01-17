import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const UpdateLibraryButton: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'updating' | 'success' | 'error'>('idle');
    const [version, setVersion] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkVersion = async () => {
            // @ts-ignore
            if (!window.electron || !window.electron.library) {
                console.warn('Electron library API not available');
                return;
            }
            try {
                // @ts-ignore
                const currentVersion = await window.electron.library.getVersion();
                setVersion(currentVersion);

                // @ts-ignore
                const updateInfo = await window.electron.library.checkUpdate();
                if (updateInfo.available) {
                    setStatus('available');
                }
            } catch (err) {
                console.error('Failed to check library version:', err);
            }
        };
        checkVersion();
    }, []);

    const handleUpdate = async () => {
        // @ts-ignore
        if (!window.electron || !window.electron.library) {
            setError('Electron API not available');
            return;
        }
        setStatus('updating');
        setError(null);
        try {
            // @ts-ignore
            const result = await window.electron.library.update(true);
            if (result.success) {
                setStatus('success');
                setVersion(result.version);
                // Notify other components that firmware has been updated
                window.dispatchEvent(new CustomEvent('firmware-updated'));
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
                setError(result.error);
            }
        } catch (err) {
            setStatus('error');
            setError('Failed to update library');
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleUpdate}
                disabled={status === 'updating' || status === 'checking'}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${status === 'available'
                    ? 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse'
                    : status === 'updating'
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : status === 'success'
                            ? 'bg-green-500 text-white'
                            : status === 'error'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                title={version ? `Current version: ${version}` : 'Check for updates'}
                style={{
                    border: 'none',
                    cursor: status === 'updating' ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                {status === 'updating' ? (
                    <>
                        <Loader2 size={16} className="rotating-spin" />
                        Updating...
                    </>
                ) : status === 'success' ? (
                    <>
                        <CheckCircle size={16} />
                        Updated
                    </>
                ) : status === 'error' ? (
                    <>
                        <AlertCircle size={16} />
                        Error
                    </>
                ) : (
                    <>
                        <RefreshCw size={16} className={status === 'checking' ? 'rotating-spin' : ''} />
                        {status === 'available' ? 'Update Library' : 'Download Firmware'}
                    </>
                )}
            </button>
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
};

export default UpdateLibraryButton;
