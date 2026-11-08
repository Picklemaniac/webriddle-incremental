export function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return String(value);
    }
    if (Math.abs(value) < 1_000_000) {
        return Math.floor(value).toLocaleString('en-US');
    }
    return value.toExponential(2).replace('e+', 'e');
}

const byteUnits = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] as const;

export function formatBytes(bytes: number): string {
    let value = Math.max(0, bytes);
    let unit = 0;
    while (value >= 1024 && unit < byteUnits.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const scale = unit === 0 || value >= 100 ? 1 : value >= 10 ? 10 : 100;
    return `${Math.floor(value * scale) / scale} ${byteUnits[unit]}`;
}

export function formatDuration(totalSeconds: number): string {
    const seconds = Math.floor(totalSeconds);
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    const remainingSeconds = seconds % 60;
    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
}
