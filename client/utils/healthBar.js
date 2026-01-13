export function getHealthBarColor(healthPercentage, hasShield) {
    if (hasShield) return '#2196F3';
    if (healthPercentage > 60) return '#4CAF50';
    if (healthPercentage > 30) return '#FF9800';
    return '#F44336';
}
