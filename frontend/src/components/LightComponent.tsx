// ... existing code ...\n\nimport React, { useEffect } from 'react';\n\ninterface LightProps {\n  triggerSignal: boolean;\n  pulseLength: number;\n}\n\nclass Light extends React.Component<LightProps> {\n  componentDidMount() {\n    this.addFlashClassAndRemoveAfterPulseLength();\n  }\n\n  componentWillUnmount() {\n    // No cleanup needed in this case since the class is removed after a delay.\n  }\n\n  addFlashClassAndRemoveAfterPulseLength = () => {\n    const flashElement = document.createElement('div');\n    flashElement.className = 'flash';\n    document.body.appendChild(flashElement);\n\n    // Set up CSS keyframes for the flashing animation\n    const style = document.createElement('style');\n    style.innerHTML = `@keyframes flash {\n      0% { background-color: yellow; }\n      50% { background-color: red; }\n      100% { background-color: yellow; }\n    }`\n\n    document.head.appendChild(style);\n\n    // Add the class and remove it after the pulseLength duration\n    setTimeout(() => {\n      flashElement.classList.remove('flash');\n      document.body.removeChild(flashElement);\n    }, this.props.pulseLength * 1000);\n  }\n\n  render() {\n    return null; // or any other content you want the light to display\n  }\n}\n\nclass Flash extends React.Component {} // A dummy component that serves as a placeholder for the keyframes\nexport default Light;\n\n// ... rest of code ...\n
import React, { useEffect } from 'react';
// @ts-ignore
import './LightComponent.css';

interface LightComponentProps {
    triggerSignal: boolean;
    pulseLength: number;
}

export function LightComponent({ triggerSignal, pulseLength }: LightComponentProps) {
    const [classNames, setClassNames] = React.useState(triggerSignal ? 'light flash' : 'light');
    useEffect(() => {
        if (triggerSignal) {
            setClassNames('light flash');
            const timeout = setTimeout(() => {
                setClassNames('light');
            }, pulseLength * 1000);
            return () => clearTimeout(timeout);
        }
    }, [triggerSignal, pulseLength]);

    return <div className={classNames} />;
}