require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'OPTIONS', 'DELETE'],
}));
app.use(express.json());

// Middleware para logar requisições (coloque antes das rotas)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Configuração da conexão MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(() => console.log('✅ Conectado ao MySQL com sucesso!'))
  .catch(err => console.error('❌ Erro ao conectar ao MySQL:', err));


// POST - cadastrar convidado (ATUALIZADO)
app.post('/cadastrar-convidado', async (req, res) => {
  const { nome, telefone } = req.body;

  if (!nome || !telefone) {
    return res.status(400).json({ mensagem: 'Nome e telefone são obrigatórios.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO confirmacoes_presenca (nome, telefone) VALUES (?, ?)`,
      [nome, telefone]
    );

    res.json({ mensagem: 'Convidado cadastrado com sucesso!', id: result.insertId });
  } catch (error) {
    console.error('Erro ao salvar no banco:', error);
    res.status(500).json({ mensagem: 'Erro ao salvar o convidado' });
  }
});


// GET - listar todos os convidados
app.get('/convidados', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM confirmacoes_presenca');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar convidados:', error);
    res.status(500).json({ mensagem: 'Erro ao buscar convidados' });
  }
});

// GET - listar convidados confirmados
app.get('/convidados/confirmados', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM confirmacoes_presenca WHERE Confirmado = 1');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar convidados confirmados:', error);
    res.status(500).json({ mensagem: 'Erro ao buscar convidados confirmados' });
  }
});

// GET - buscar convidado pelo ID
app.get('/convidados/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM confirmacoes_presenca WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ mensagem: 'Convidado não encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar convidado:', error);
    res.status(500).json({ mensagem: 'Erro ao buscar convidado' });
  }
});


// PUT - confirmar presença do convidado pelo ID
app.put('/confirmar-presenca/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE confirmacoes_presenca SET Confirmado = 1 WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Convidado não encontrado' });
    }

    res.json({ mensagem: `Presença confirmada para o convidado com ID ${id}` });
  } catch (error) {
    console.error('Erro ao confirmar presença:', error);
    res.status(500).json({ mensagem: 'Erro ao confirmar presença' });
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

// ROTA PARA ATUALIZAR UM PRESENTE
app.put('/presentes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nomePresente, imagemPresente, linkPresente } = req.body;

    if (!nomePresente || !linkPresente) {
      return res.status(400).json({ mensagem: 'Nome e link são obrigatórios.' });
    }

    const [result] = await pool.query(
      'UPDATE presentes SET nome = ?, imagem = ?, link = ? WHERE id = ?',
      [nomePresente, imagemPresente, linkPresente, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Presente não encontrado.' });
    }

    return res.status(200).json({ mensagem: 'Presente atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar presente:', error);
    return res.status(500).json({ mensagem: 'Erro ao atualizar presente' });
  }
});

// ROTA PARA DELETAR UM PRESENTE
app.delete('/presentes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM presentes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Presente não encontrado.' });
    }

    return res.status(200).json({ mensagem: 'Presente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir presente:', error);
    return res.status(500).json({ mensagem: 'Erro ao excluir presente.' });
  }
});


// ROTA PARA BUSCAR UM PRESENTE PELO ID
app.get('/presentes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      'SELECT id, nome AS nomePresente, imagem AS imagemPresente, link AS linkPresente FROM presentes WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ mensagem: 'Presente não encontrado.' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar presente:', error);
    res.status(500).json({ mensagem: 'Erro ao buscar presente.' });
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
