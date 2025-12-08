

import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { IconPicker } from './IconPicker';
import { LOGO_ICON_LIST } from '../constants';
import { Spinner } from './Spinner';

// This is a workaround for the no-build-tool environment
declare const html2canvas: any;

interface LogoBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    companyName: string;
    onLogoGenerated: (file: File) => void;
}

export const LogoBuilder: React.FC<LogoBuilderProps> = ({ isOpen, onClose, companyName, onLogoGenerated }) => {
    const [icon, setIcon] = useState<keyof typeof LOGO_ICON_LIST>('SparklesIcon');
    const [text, setText] = useState(companyName);
    const [layout, setLayout] = useState<'icon-top' | 'icon-left'>('icon-top');
    const [iconColor, setIconColor] = useState('#3b82f6'); // primary-500
    const [textColor, setTextColor] = useState('#1f2937'); // gray-800
    const [font, setFont] = useState('font-sans');
    const [background, setBackground] = useState<'none' | 'circle' | 'square'>('none');
    const [isGenerating, setIsGenerating] = useState(false);
    const [iconWidth, setIconWidth] = useState(64);
    const [iconHeight, setIconHeight] = useState(64);

    const previewRef = useRef<HTMLDivElement>(null);

    const SelectedIcon = LOGO_ICON_LIST[icon];

    const handleGenerate = async () => {
        if (!previewRef.current) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(previewRef.current, {
                backgroundColor: null, // Transparent background
                scale: 2, // Higher resolution
            });

            // Promisify canvas.toBlob for robust error handling
            const blob = await new Promise<Blob | null>(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });

            if (!blob) {
                throw new Error("Falha ao gerar a imagem. Tente novamente.");
            }

            const file = new File([blob], 'logo.png', { type: 'image/png' });
            onLogoGenerated(file);
        } catch (error) {
            console.error("Error generating logo:", error);
            // You could show a notification to the user here.
        } finally {
            setIsGenerating(false);
        }
    };

    const fontOptions = [
        { value: 'font-sans', label: 'Sans-Serif (Padrão)' },
        { value: 'font-serif', label: 'Serif' },
        { value: 'font-mono', label: 'Monospace' },
    ];
    
    // Workaround for Tailwind JIT not picking up dynamic classes
    const fontClasses: { [key: string]: React.CSSProperties } = {
        'font-sans': { fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"' },
        'font-serif': { fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
        'font-mono': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
    };


    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Construtor de Logo" size="xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Controls */}
                <div className="md:col-span-1 space-y-4">
                    <h3 className="font-semibold">1. Ícone</h3>
                    <IconPicker selectedIcon={icon} onSelect={setIcon} />

                    <h3 className="font-semibold">2. Texto</h3>
                    <Input label="Nome da Empresa" value={text} onChange={(e) => setText(e.target.value)} />
                    <Select label="Fonte" value={font} onChange={(e) => setFont(e.target.value)} options={fontOptions} />
                    
                    <h3 className="font-semibold">3. Cores</h3>
                    <Input label="Cor do Ícone" type="color" value={iconColor} onChange={(e) => setIconColor(e.target.value)} />
                    <Input label="Cor do Texto" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                    
                    <h3 className="font-semibold">4. Layout e Dimensões</h3>
                    <Select
                        label="Layout"
                        value={layout}
                        onChange={(e) => setLayout(e.target.value as any)}
                        options={[{value: 'icon-top', label: 'Ícone Acima'}, {value: 'icon-left', label: 'Ícone à Esquerda'}]}
                    />
                    <Select
                        label="Fundo"
                        value={background}
                        onChange={(e) => setBackground(e.target.value as any)}
                        options={[{value: 'none', label: 'Transparente'}, {value: 'circle', label: 'Círculo'}, {value: 'square', label: 'Quadrado'}]}
                    />
                    <div>
                        <label htmlFor="iconWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Largura do Ícone: <span className="font-bold">{iconWidth}px</span>
                        </label>
                        <input
                            id="iconWidth"
                            type="range"
                            min="32"
                            max="128"
                            step="2"
                            value={iconWidth}
                            onChange={(e) => setIconWidth(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                        />
                    </div>
                    <div>
                        <label htmlFor="iconHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Altura do Ícone: <span className="font-bold">{iconHeight}px</span>
                        </label>
                        <input
                            id="iconHeight"
                            type="range"
                            min="32"
                            max="128"
                            step="2"
                            value={iconHeight}
                            onChange={(e) => setIconHeight(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                        />
                    </div>
                </div>

                {/* Preview */}
                <div className="md:col-span-2 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 p-4 rounded-lg min-h-[300px] relative">
                    {isGenerating && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg z-10">
                            <Spinner />
                            <p className="text-white mt-2">Gerando sua logo...</p>
                        </div>
                    )}
                    <h3 className="font-semibold mb-4">Pré-visualização</h3>
                    <div
                        ref={previewRef}
                        className={`inline-flex items-center justify-center p-4 
                            ${layout === 'icon-top' ? 'flex-col' : 'flex-row gap-4'}
                            ${background === 'circle' ? 'rounded-full bg-gray-200 dark:bg-gray-600' : ''}
                            ${background === 'square' ? 'rounded-lg bg-gray-200 dark:bg-gray-600' : ''}
                        `}
                    >
                        <SelectedIcon
                            style={{
                                color: iconColor,
                                width: `${iconWidth}px`,
                                height: `${iconHeight}px`,
                            }}
                        />
                        <h2
                            className="text-2xl font-bold text-center"
                            style={{ color: textColor, ...fontClasses[font] }}
                        >
                            {text}
                        </h2>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <Button onClick={handleGenerate} isLoading={isGenerating}>
                    Gerar e Usar esta Logo
                </Button>
            </div>
        </Modal>
    );
};
