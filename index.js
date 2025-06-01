const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'meuSegredoUltraSecreto123!';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
}));
app.use(express.json());

// Middleware para logar requisições (coloque antes das rotas)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Configuração da conexão MySQL
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'wedding',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(() => console.log('✅ Conectado ao MySQL com sucesso!'))
  .catch(err => console.error('❌ Erro ao conectar ao MySQL:', err));

// Rotas
app.post('/confirmar-presenca', async (req, res) => {
  const { nome, levarAcompanhante, acompanhantes, temRestricao, restricao } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO confirmacoes_presenca 
        (nome, levar_acompanhante, acompanhantes, tem_restricao, restricao) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        nome,
        levarAcompanhante,
        JSON.stringify(acompanhantes),
        temRestricao,
        restricao || null
      ]
    );

    console.log('Resultado do insert:', result);

    res.json({ mensagem: 'Confirmação de presença salva com sucesso!', id: result.insertId });
  } catch (error) {
    console.error('Erro ao salvar no banco:', error);
    res.status(500).json({ mensagem: 'Erro ao salvar a confirmação' });
  }
});


const bcrypt = require('bcrypt');

app.post('/register', async (req, res) => {
  const { nome, email } = req.body;
  let { senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ mensagem: 'Nome, email e senha são obrigatórios.' });
  }

  senha = senha.trim();

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const [result] = await pool.query(
      `INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`,
      [nome, email, senhaHash]
    );

    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!', usuarioId: result.insertId });
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ mensagem: 'Erro ao cadastrar usuário' });
  }
});


app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    // Buscar usuário pelo email
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ mensagem: 'Usuário não encontrado' });
    }

    // Verificar se a senha bate com o hash salvo
    const senhaCorreta = await bcrypt.compare(senha, user.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ mensagem: 'Senha incorreta' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Retirar a senha do objeto para não enviar
    const { senha: _, ...userSemSenha } = user;

    // Retornar dados do usuário e token
    res.json({
      mensagem: 'Login bem-sucedido',
      user: userSemSenha,
      token
    });
  } catch (error) {
    console.error('Erro ao realizar login:', error);
    res.status(500).json({ mensagem: 'Erro ao realizar login' });
  }
});

// ROTA PARA CADASTRAR PRESENTE
app.post('/presentes', async (req, res) => {
  try {
    const { nomePresente, imagemPresente, linkPresente } = req.body;
    
    if (!nomePresente || !linkPresente) {
      return res.status(400).json({ mensagem: 'Nome e link são obrigatórios.' });
    }

    const [result] = await pool.query(
      'INSERT INTO presentes (nome, imagem, link) VALUES (?, ?, ?)',
      [nomePresente, imagemPresente, linkPresente]
    );

    return res.status(201).json({ mensagem: 'Presente cadastrado com sucesso!', id: result.insertId });
  } catch (error) {
    console.error('Erro ao cadastrar presente:', error);
    return res.status(500).json({ mensagem: 'Erro ao cadastrar presente' });
  }
});

//ROTA PARA LISTAR PRESENTES
app.get('/presentes', async (req, res) => {
  try {
    const [presentes] = await pool.query(
      'SELECT id, nome AS nomePresente, imagem AS imagemPresente, link AS linkPresente FROM presentes'
    );
    res.json(presentes);
  } catch (error) {
    console.error('Erro ao buscar presentes:', error);
    res.status(500).json({ mensagem: 'Erro ao buscar presentes' });
  }
});

// Middleware para tratar erros (deve ficar após as rotas)
app.use((err, req, res, next) => {
  console.error('Erro capturado:', err);
  res.status(500).json({ mensagem: 'Erro interno do servidor' });
});

// Servidor ouvindo (sempre por último)
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
