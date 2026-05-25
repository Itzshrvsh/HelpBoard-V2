import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';

const features = [
  { icon: '📝', title: 'Post Tasks', desc: 'Create help requests with credit bounties and deadlines' },
  { icon: '🤝', title: 'Find Helpers', desc: 'Review claims, chat, and select the best fit' },
  { icon: '🔒', title: 'Secure Escrow', desc: 'Credits held safely, released only on dual confirmation' },
  { icon: '💬', title: 'Direct Chat', desc: 'Separate chats per helper to share skills and proof' },
  { icon: '🏆', title: 'Leaderboard', desc: 'Top performers earn recognition and trust' },
  { icon: '⭐', title: 'Ratings', desc: 'Both sides rate each other after completion' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-950/20 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm mb-6">
              🚀 Human Task Marketplace
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Need Help?{' '}
              <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                Post a Task
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-surface-400 mb-8 max-w-xl mx-auto leading-relaxed">
              HelpBoard connects people who need help with skilled helpers. Post tasks, set credit bounties, 
              and get things done — securely.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="text-base px-8">
                  Get Started Free
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" size="lg" className="text-base px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-surface-400 max-w-xl mx-auto">
            A secure, transparent marketplace for human-powered tasks
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-xl p-6 border border-surface-800/50 hover:border-surface-700/60 transition-all duration-300"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-surface-400">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-12 text-center border border-primary-500/10 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600/5 to-primary-800/5 pointer-events-none" />
          <h2 className="text-3xl font-bold text-white mb-4 relative z-10">
            Ready to Get Started?
          </h2>
          <p className="text-surface-400 mb-8 max-w-md mx-auto relative z-10">
            Join HelpBoard today and start getting things done with trusted helpers.
          </p>
          <Link to="/signup" className="relative z-10">
            <Button size="lg" className="text-base px-8">
              Create Free Account
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-surface-800/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">HB</span>
              </div>
              <span className="text-sm text-surface-400">HelpBoard</span>
            </div>
            <p className="text-xs text-surface-500">© 2024 HelpBoard. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
