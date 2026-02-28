body {

    margin: 0;
    font-family: Arial, sans-serif;
    background: black;
    color: white;
    text-align: center;
}

.container {

    padding: 15px;
}


/* Avatar container */
#avatarContainer {

    position: relative;

    width: 220px;      /* desktop size */

    max-width: 60vw;   /* mobile safe */

    margin: 20px auto;
}


/* Avatar image */
#avatar {

    width: 100%;

    height: auto;

    display: block;
}


/* Mouth overlay */
#mouth {

    position: absolute;

    left: 50%;

    transform: translateX(-50%);

    bottom: 28%;   /* percentage fixes all screen sizes */

    width: 22%;

    height: 6%;

    background: limegreen;

    border-radius: 20px;

    opacity: 0;

    pointer-events: none;
}


.talking {

    opacity: 1;

    animation: mouthMove 0.15s infinite alternate;
}


@keyframes mouthMove {

    from {
        transform: translateX(-50%) scaleY(1);
    }

    to {
        transform: translateX(-50%) scaleY(1.9);
    }
}


/* Thinking bubble */
#thinking {

    position: absolute;

    top: -25px;

    left: 50%;

    transform: translateX(-50%);

    font-size: 22px;

    opacity: 0;
}

.thinkingActive {

    opacity: 1;

    animation: blink 1s infinite;
}


@keyframes blink {

    0%{opacity:0;}
    50%{opacity:1;}
    100%{opacity:0;}
}


/* Input */
textarea {

    width: 90%;

    max-width: 400px;

    height: 80px;

    font-size: 16px;
}


/* Buttons */
button {

    width: 130px;

    height: 45px;

    font-size: 16px;

    margin: 8px;
}


/* Logo */
#logo {

    width: 110px;

    margin-top: 10px;
}


/* Powered text */
#powered {

    font-size: 18px;

    margin-top: 6px;
}


/* Copyright */
#copyright {

    margin-top: 30px;

    font-size: 12px;

    opacity: 0.5;
}


/* Mobile adjustments */
@media (max-width:600px){

    #avatarContainer {

        width: 180px;
    }

}
