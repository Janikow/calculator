const numberOfButtons = 50;

const container = document.getElementById("grid-container");

const buttons = [];

// Create buttons
for (let i = 1; i <= numberOfButtons; i++) {
    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = "conwaybtn";
    btn.id = `button${i}`;
    btn.textContent = `Button ${i}`;

    container.appendChild(btn);

    buttons.push(btn);
}

function lexample(event) {
    console.log("Clicked:", event.target.id);
}

// Add event listener to every button
buttons.forEach(button => {
    button.addEventListener("click", lexample);
});
