export function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return String(value);
    }
    if (Math.abs(value) < 1_000_000) {
        return Math.floor(value).toLocaleString('en-US');
    }
    return value.toExponential(2).replace('e+', 'e');
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
