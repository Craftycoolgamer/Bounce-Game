export function getHealthBarColor(healthPercentage) {
    if (healthPercentage > 60) return '#4CAF50';
    if (healthPercentage > 30) return '#FF9800';
    return '#F44336';
}
