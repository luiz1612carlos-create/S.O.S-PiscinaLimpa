
import React, { useEffect, useState } from 'react';
import { NotificationType } from '../types';
import { CheckIcon, XMarkIcon } from '../constants';

interface NotificationProps {
    message: string;
    type: NotificationType;
    onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
            // Allow time for fade-out animation before calling onClose
            setTimeout(onClose, 300);
        }, 2700);

        return () => clearTimeout(timer);
    }, [message, type, onClose]);

    const baseClasses = "fixed top-5 right-5 w-auto max-w-sm p-4 rounded-lg shadow-lg flex items-center z-50 transition-all duration-300";
    const typeClasses = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white',
    };
    const visibilityClasses = visible ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-full';
    
    const Icon = type === 'success' ? CheckIcon : XMarkIcon;

    return (
        <div className={`${baseClasses} ${typeClasses[type]} ${visibilityClasses}`}>
            <Icon className="w-6 h-6 mr-3"/>
            <span>{message}</span>
        </div>
    );
};
