
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    options: { value: string | number; label: string }[];
    containerClassName?: string;
}

export const Select: React.FC<SelectProps> = ({ label, id, options, containerClassName = '', ...props }) => {
    const selectId = id || `select-${props.name}`;
    return (
        <div className={`mb-4 ${containerClassName}`}>
            <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
            </label>
            <select
                id={selectId}
                className="w-full px-3 py-2 border rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                {...props}
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    );
};
