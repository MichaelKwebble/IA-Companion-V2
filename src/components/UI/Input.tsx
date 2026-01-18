import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <div className={`input-container ${error ? 'has-error' : ''} ${className}`}>
            {label && <label htmlFor={inputId} className="input-label">{label}</label>}
            <div className="input-wrapper">
                {leftIcon && <span className="input-icon-left">{leftIcon}</span>}
                <input
                    id={inputId}
                    className={`input-field ${leftIcon ? 'with-left-icon' : ''} ${rightIcon ? 'with-right-icon' : ''}`}
                    {...props}
                />
                {rightIcon && <span className="input-icon-right">{rightIcon}</span>}
            </div>
            {error && <span className="input-error-text">{error}</span>}
            {!error && helperText && <span className="input-helper-text">{helperText}</span>}
        </div>
    );
};

export default Input;
