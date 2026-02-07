import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
    const [value, setValue] = useState<T>(() => {
        const jsonValue = localStorage.getItem(key);
        if (jsonValue != null) {
            try {
                return JSON.parse(jsonValue, (key, value) => {
                    // Revive dates
                    if (key === 'date' && typeof value === 'string') {
                        return new Date(value);
                    }
                    return value;
                });
            } catch (e) {
                console.error('Failed to parse localStorage key “' + key + '”: ', e);
                return initialValue;
            }
        }
        return initialValue;
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue] as const;
}
