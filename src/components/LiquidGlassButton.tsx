import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LiquidGlassButton.css';

interface LiquidGlassButtonProps {
  onClick?: () => void;
  to?: string;
  text?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function LiquidGlassButton({ onClick, to, text = "Get started", className = "", icon }: LiquidGlassButtonProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
    if (to) {
      navigate(to);
    }
  };

  return (
    <div className={`liquid-glass-wrapper ${className}`}>
      <div 
        className="liquid-glass-btn" 
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        <span className="liquid-glass-text">{text}</span>
        <div className="liquid-glass-icon">
          {icon || (
            <svg
              className="lg-svg"
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M779.180132 473.232045 322.354755 16.406668c-21.413706-21.413706-56.121182-21.413706-77.534887 0-21.413706 21.413706-21.413706 56.122205 0 77.534887l418.057421 418.057421L244.819868 930.057421c-21.413706 21.413706-21.413706 56.122205 0 77.534887 10.706853 10.706853 24.759917 16.059767 38.767955 16.059767s28.061103-5.353938 38.767955-16.059767L779.180132 550.767955C800.593837 529.35425 800.593837 494.64575 779.180132 473.232045z" />
            </svg>
          )}
        </div>
        <div className="liquid-glass-circle-overlay"></div>
      </div>
    </div>
  );
}
