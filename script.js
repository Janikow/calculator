const button1 = document.getElementById("button1");

function lexample()
{
    const img = document.createElement("img");
    img.scr = "image.jpg";
    img.alt = "An Image";
    img.width = 300;

    document.getElementById("imageContainer").appendChild(img);
}

button1.addEventListener("click", lexample);