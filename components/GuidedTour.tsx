import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { XMarkIcon } from '../constants';

export interface TourStep {
    selector: string;
    highlightSelector?: string; // If provided, this element gets the spotlight, while `selector` is used for positioning.
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right'; // Preferred popover position.
}

interface GuidedTourProps {
    steps: TourStep[];
    isOpen: boolean;
    onClose: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ steps, isOpen, onClose }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const [popoverClass, setPopoverClass] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const highlightedElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            if (highlightedElementRef.current) {
                highlightedElementRef.current.classList.remove('tour-highlight');
                highlightedElementRef.current = null;
            }
            setCurrentStepIndex(0); // Reset on close
            return;
        }

        const update = () => updatePopoverPosition(steps[currentStepIndex]);
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNextStep();
            else if (e.key === 'ArrowLeft') goToPrevStep();
            else if (e.key === 'Escape') onClose();
        };

        window.addEventListener('resize', update);
        document.addEventListener('keydown', handleKeyDown);

        // A small delay to allow elements to render before positioning
        const timer = setTimeout(update, 100);

        return () => {
            window.removeEventListener('resize', update);
            document.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timer);
            if (highlightedElementRef.current) {
                highlightedElementRef.current.classList.remove('tour-highlight');
            }
        };

    }, [isOpen, currentStepIndex, steps]);

    const updatePopoverPosition = (step: TourStep) => {
        if (highlightedElementRef.current) {
            highlightedElementRef.current.classList.remove('tour-highlight');
        }

        const positionTarget = document.querySelector(step.selector) as HTMLElement;
        const highlightTarget = document.querySelector(step.highlightSelector || step.selector) as HTMLElement;

        if (highlightTarget) {
            highlightTarget.classList.add('tour-highlight');
            highlightedElementRef.current = highlightTarget;
            // Use 'nearest' to avoid excessive scrolling if the element is already partially visible.
            highlightTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }

        const positioningElement = positionTarget || highlightTarget;

        if (positioningElement) {
            const targetRect = positioningElement.getBoundingClientRect();
            const popoverEl = popoverRef.current;
            if (!popoverEl) return;

            const popoverHeight = popoverEl.offsetHeight;
            const popoverWidth = popoverEl.offsetWidth;
            const space = 15; // Space between element and popover
            const pos = step.position || 'bottom';
            let newPopoverClass = '';

            let top = 0, left = 0;

            switch (pos) {
                case 'top':
                    top = targetRect.top - popoverHeight - space;
                    left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
                    newPopoverClass = 'tour-popover-top';
                    break;
                case 'right':
                    top = targetRect.top + (targetRect.height / 2) - (popoverHeight / 2);
                    left = targetRect.right + space;
                    newPopoverClass = 'tour-popover-right';
                    break;
                case 'left':
                    top = targetRect.top + (targetRect.height / 2) - (popoverHeight / 2);
                    left = targetRect.left - popoverWidth - space;
                    newPopoverClass = 'tour-popover-left';
                    break;
                case 'bottom':
                default:
                    top = targetRect.bottom + space;
                    left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
                    newPopoverClass = 'tour-popover-bottom';
            }

            // Clamp position to be within viewport
            if (left < space) left = space;
            if (left + popoverWidth > window.innerWidth - space) left = window.innerWidth - popoverWidth - space;
            if (top < space) top = space;
            if (top + popoverHeight > window.innerHeight - space) top = window.innerHeight - popoverHeight - space;

            setPopoverPosition({ top, left });
            setPopoverClass(newPopoverClass);

        } else {
            // Fallback for elements not found (e.g., initial welcome step)
            setPopoverPosition({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 150 });
            setPopoverClass('');
        }
    };

    const goToNextStep = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        } else {
            onClose();
        }
    };

    const goToPrevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };

    if (!isOpen) return null;
    const currentStep = steps[currentStepIndex];

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose}></div>
            <style>{`
                .tour-highlight {
                    position: relative;
                    z-index: 50 !important;
                    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 15px rgba(255,255,255,0.5);
                    border-radius: 6px;
                    transition: box-shadow 0.3s ease-in-out;
                }
                .tour-popover-bottom::after {
                    content: ''; position: absolute; left: 50%; top: -10px; transform: translateX(-50%);
                    border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 10px solid rgb(248 250 252);
                }
                .dark .tour-popover-bottom::after { border-bottom-color: rgb(30 41 59); }
                .tour-popover-top::after {
                    content: ''; position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%);
                    border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid rgb(248 250 252);
                }
                .dark .tour-popover-top::after { border-top-color: rgb(30 41 59); }
                .tour-popover-right::after {
                    content: ''; position: absolute; top: 50%; left: -10px; transform: translateY(-50%);
                    border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-right: 10px solid rgb(248 250 252);
                }
                .dark .tour-popover-right::after { border-right-color: rgb(30 41 59); }
                .tour-popover-left::after {
                    content: ''; position: absolute; top: 50%; right: -10px; transform: translateY(-50%);
                    border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-left: 10px solid rgb(248 250 252);
                }
                .dark .tour-popover-left::after { border-left-color: rgb(30 41 59); }
            `}</style>
            <div
                ref={popoverRef}
                className={`fixed bg-slate-50 dark:bg-slate-800 rounded-lg shadow-2xl z-[51] w-80 transition-all duration-300 border border-slate-200 dark:border-slate-700 ${popoverClass}`}
                style={{ top: `${popoverPosition.top}px`, left: `${popoverPosition.left}px` }}
            >
                <div className="p-4 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"
                        aria-label="Fechar tour"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 pr-6">{currentStep.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{currentStep.content}</p>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-700 rounded-b-lg">
                    <span className="text-xs text-gray-500">{currentStepIndex + 1} / {steps.length}</span>
                    <div className="flex gap-2">
                        {currentStepIndex > 0 && (
                            <Button variant="secondary" size="sm" onClick={goToPrevStep}>Anterior</Button>
                        )}
                        <Button size="sm" onClick={goToNextStep}>
                            {currentStepIndex === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};