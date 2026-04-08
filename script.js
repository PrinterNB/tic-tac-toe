// Main menu script
document.addEventListener('DOMContentLoaded', function() {
    const humanVsHumanBtn = document.getElementById('human-vs-human');
    const humanVsAiBtn = document.getElementById('human-vs-ai');
    
    humanVsHumanBtn.addEventListener('click', function() {
        // Create a temporary form to navigate to the human vs human game
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = 'human-vs-human.html';
        document.body.appendChild(form);
        form.submit();
    });
    
    humanVsAiBtn.addEventListener('click', function() {
        // Create a temporary form to navigate to the human vs AI game
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = 'human-vs-ai.html';
        document.body.appendChild(form);
        form.submit();
    });
});