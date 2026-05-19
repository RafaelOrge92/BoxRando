import express from 'express';
// Separamos la importación de tipos para cumplir con 'verbatimModuleSyntax'
import type { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

interface RollRequest {
    totalBoxes: number;
    blockedPositions: string[];
}

app.post('/api/roll', (req: Request<{}, {}, RollRequest>, res: Response) => {
    const { totalBoxes, blockedPositions } = req.body;

    if (!totalBoxes || totalBoxes < 1) {
        return res.status(400).json({ error: 'Número de cajas inválido' });
    }

    const ROWS = 5;
    const COLS = 6;
    const allPossiblePositions: { box: number; row: number; col: number; id: string }[] = [];

    for (let b = 1; b <= totalBoxes; b++) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const id = `${b}-${r}-${c}`;
                // Validamos que las posiciones bloqueadas no vengan vacías o indefinidas
                if (blockedPositions && !blockedPositions.includes(id)) {
                    allPossiblePositions.push({ box: b, row: r, col: c, id });
                }
            }
        }
    }

    if (allPossiblePositions.length === 0) {
        return res.status(400).json({ error: 'No quedan posiciones disponibles. ¡Desbloquea alguna!' });
    }

    const randomIndex = Math.floor(Math.random() * allPossiblePositions.length);
    const result = allPossiblePositions[randomIndex];

    // Con 'noUncheckedIndexedAccess' activo, TypeScript teme que 'result' sea undefined.
    // Añadimos una salvaguarda por si acaso para que compile perfectamente.
    if (!result) {
        return res.status(500).json({ error: 'Error interno al seleccionar la posición' });
    }

    return res.json(result);
});

app.listen(PORT, () => {
    console.log(`⚡ Servidor corriendo en http://localhost:${PORT}`);
});