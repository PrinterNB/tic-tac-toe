// Menu button event listeners
document.addEventListener('DOMContentLoaded', function() {
    const humanVsHumanBtn = document.getElementById('human-vs-human');
    const humanVsAiBtn = document.getElementById('human-vs-ai');
    
    if (humanVsHumanBtn) {
        humanVsHumanBtn.addEventListener('click', function() {
            window.location.href = 'human-vs-human.html';
        });
    }
    
    if (humanVsAiBtn) {
        humanVsAiBtn.addEventListener('click', function() {
            window.location.href = 'human-vs-ai.html';
        });
    }
});