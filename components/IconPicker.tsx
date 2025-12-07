
import React, { useState } from 'react';
import { LOGO_ICON_LIST } from '../constants';
import { Input } from './Input';

interface IconPickerProps {
    selectedIcon: keyof typeof LOGO_ICON_LIST;
    onSelect: (iconName: keyof typeof LOGO_ICON_LIST) => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelect }) => {
    const [filter, setFilter] = useState('');

    const filteredIcons = Object.keys(LOGO_ICON_LIST).filter(name =>
        name.toLowerCase().includes(filter.toLowerCase())
    ) as (keyof typeof LOGO_ICON_LIST)[];

    return (
        <div>
            <Input
                label="Buscar Ícone"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Ex: Sun, Check..."
            />
            <div className="grid grid-cols-4 gap-2 mt-2 max-h-48 overflow-y-auto border p-2 rounded-md dark:border-gray-600">
                {filteredIcons.map(iconName => {
                    const IconComponent = LOGO_ICON_LIST[iconName];
                    const isSelected = iconName === selectedIcon;
                    return (
                        <button
                            key={iconName}
                            type="button"
                            onClick={() => onSelect(iconName)}
                            className={`p-2 rounded-md flex items-center justify-center transition-colors ${
                                isSelected
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            <IconComponent className="w-6 h-6" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
